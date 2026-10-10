"use client";

import React, { useState, useEffect, useCallback } from "react";
import {
  MapPinIcon,
  PlusIcon,
  EditIcon,
  TrashIcon,
  CheckIcon,
  AlertCircleIcon,
  CloseIcon,
} from "@/components/customer/Icons";
import type { CustomerAddress } from "@/lib/server/address";

export default function AccountAddresses() {
  const [addresses, setAddresses] = useState<CustomerAddress[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Form modal state
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingAddress, setEditingAddress] = useState<CustomerAddress | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Form field state
  const [formData, setFormData] = useState({
    label: "",
    fullName: "",
    phone: "",
    addressLine1: "",
    addressLine2: "",
    city: "",
    state: "",
    postalCode: "",
    country: "India",
    isDefault: false,
  });
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});

  const showToast = useCallback((msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3000);
  }, []);

  const loadAddresses = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/customer/addresses", {
        headers: { "Cache-Control": "no-cache" },
        credentials: "same-origin",
      });
      const data = await res.json();
      if (res.ok && data.ok) {
        setAddresses(data.addresses || []);
      } else {
        setError(data.error || "Failed to load addresses");
      }
    } catch {
      setError("Network error: Unable to load saved addresses");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadAddresses();
  }, [loadAddresses]);

  const handleOpenAddModal = () => {
    setEditingAddress(null);
    setFormData({
      label: "Home",
      fullName: "",
      phone: "",
      addressLine1: "",
      addressLine2: "",
      city: "",
      state: "",
      postalCode: "",
      country: "India",
      isDefault: addresses.length === 0,
    });
    setFormErrors({});
    setIsModalOpen(true);
  };

  const handleOpenEditModal = (addr: CustomerAddress) => {
    setEditingAddress(addr);
    setFormData({
      label: addr.label || "Home",
      fullName: addr.fullName,
      phone: addr.phone,
      addressLine1: addr.addressLine1,
      addressLine2: addr.addressLine2 || "",
      city: addr.city,
      state: addr.state,
      postalCode: addr.postalCode,
      country: addr.country || "India",
      isDefault: addr.isDefault,
    });
    setFormErrors({});
    setIsModalOpen(true);
  };

  const validateForm = () => {
    const errs: Record<string, string> = {};
    if (!formData.fullName.trim() || formData.fullName.trim().length < 2) {
      errs.fullName = "Full name must be at least 2 characters";
    }
    if (!/^[6-9]\d{9}$/.test(formData.phone.trim())) {
      errs.phone = "Valid 10-digit mobile number required (e.g. 9876543210)";
    }
    if (!formData.addressLine1.trim() || formData.addressLine1.trim().length < 5) {
      errs.addressLine1 = "Flat/Building & Street name required (min 5 characters)";
    }
    if (!formData.city.trim() || formData.city.trim().length < 2) {
      errs.city = "City / Town is required";
    }
    if (!formData.state.trim() || formData.state.trim().length < 2) {
      errs.state = "State / Province is required";
    }
    if (!/^\d{6}$/.test(formData.postalCode.trim())) {
      errs.postalCode = "Valid 6-digit Indian PIN code required";
    }
    setFormErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateForm()) return;

    setIsSubmitting(true);
    try {
      if (editingAddress) {
        // PATCH existing
        const res = await fetch(`/api/customer/addresses/${editingAddress.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          credentials: "same-origin",
          body: JSON.stringify(formData),
        });
        const data = await res.json();
        if (res.ok && data.ok) {
          showToast("Address updated successfully!");
          setIsModalOpen(false);
          await loadAddresses();
        } else {
          setFormErrors({ general: data.error || "Failed to update address" });
        }
      } else {
        // POST new
        const res = await fetch("/api/customer/addresses", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "same-origin",
          body: JSON.stringify(formData),
        });
        const data = await res.json();
        if (res.ok && data.ok) {
          showToast("New address added successfully!");
          setIsModalOpen(false);
          await loadAddresses();
        } else {
          setFormErrors({ general: data.error || "Failed to create address" });
        }
      }
    } catch {
      setFormErrors({ general: "Network error: Unable to save address" });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSetDefault = async (addressId: string) => {
    try {
      const res = await fetch(`/api/customer/addresses/${addressId}/default`, {
        method: "POST",
        credentials: "same-origin",
      });
      const data = await res.json();
      if (res.ok && data.ok) {
        showToast("Default address updated!");
        await loadAddresses();
      }
    } catch {
      showToast("Failed to set default address");
    }
  };

  const handleDelete = async (addressId: string) => {
    if (!confirm("Are you sure you want to remove this delivery address?")) return;
    try {
      const res = await fetch(`/api/customer/addresses/${addressId}`, {
        method: "DELETE",
        credentials: "same-origin",
      });
      const data = await res.json();
      if (res.ok && data.ok) {
        showToast("Address removed");
        await loadAddresses();
      }
    } catch {
      showToast("Failed to delete address");
    }
  };

  return (
    <section
      aria-labelledby="addresses-heading"
      className="rounded-2xl border border-neutral-200 bg-surface shadow-card overflow-hidden"
    >
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-4 sm:px-6 border-b border-neutral-100">
        <div>
          <h2
            id="addresses-heading"
            className="text-base sm:text-lg font-bold text-neutral-900 tracking-tight"
          >
            Saved Delivery Addresses
          </h2>
          <p className="text-xs text-neutral-500 font-medium mt-0.5">
            Manage your dispatch destinations for quick, one-click checkout.
          </p>
        </div>

        <button
          type="button"
          onClick={handleOpenAddModal}
          className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl font-bold text-xs uppercase tracking-wider transition-all duration-200 shadow-sm hover:shadow-md cursor-pointer"
          style={{
            background: "var(--color-primary)",
            color: "var(--color-neutral-900)",
          }}
        >
          <PlusIcon size={14} />
          <span>Add Address</span>
        </button>
      </div>

      {/* Toast Notification */}
      {toastMessage && (
        <div className="mx-5 mt-4 sm:mx-6 p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-xs font-semibold text-emerald-800 flex items-center gap-2">
          <CheckIcon size={16} className="text-emerald-600 shrink-0" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Content */}
      <div className="p-5 sm:p-6">
        {isLoading ? (
          <div className="py-12 flex flex-col items-center justify-center gap-2 text-neutral-400">
            <div className="w-6 h-6 border-2 border-neutral-300 border-t-neutral-800 rounded-full animate-spin" />
            <span className="text-xs font-medium">Loading saved addresses...</span>
          </div>
        ) : error ? (
          <div className="p-4 rounded-xl bg-red-50 border border-red-200 text-xs text-red-700 flex items-center gap-2">
            <AlertCircleIcon size={16} className="shrink-0" />
            <span>{error}</span>
          </div>
        ) : addresses.length === 0 ? (
          <div className="py-10 text-center flex flex-col items-center justify-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-neutral-100 flex items-center justify-center text-neutral-400">
              <MapPinIcon size={24} />
            </div>
            <div>
              <p className="text-sm font-bold text-neutral-800">No saved addresses yet</p>
              <p className="text-xs text-neutral-500 mt-0.5">
                Add an address to speed up your future 3D print orders.
              </p>
            </div>
            <button
              type="button"
              onClick={handleOpenAddModal}
              className="mt-2 px-4 py-2 rounded-xl text-xs font-bold border border-neutral-300 hover:bg-neutral-50 transition-colors text-neutral-700 cursor-pointer"
            >
              + Add Your First Address
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {addresses.map((addr) => (
              <div
                key={addr.id}
                className={`p-4 rounded-2xl border transition-all flex flex-col justify-between gap-3 ${
                  addr.isDefault
                    ? "border-primary bg-primary/5 shadow-xs"
                    : "border-neutral-200 bg-white hover:border-neutral-300 hover:shadow-xs"
                }`}
              >
                <div>
                  <div className="flex items-center justify-between gap-2 mb-2">
                    <span className="text-[11px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-md bg-neutral-100 text-neutral-700">
                      {addr.label || "Address"}
                    </span>
                    {addr.isDefault && (
                      <span className="text-[10px] font-extrabold uppercase tracking-widest px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 flex items-center gap-1">
                        <CheckIcon size={12} className="stroke-[3]" />
                        Default
                      </span>
                    )}
                  </div>

                  <h3 className="text-sm font-bold text-neutral-900">{addr.fullName}</h3>
                  <p className="text-xs text-neutral-600 mt-0.5 font-mono">{addr.phone}</p>
                  <p className="text-xs text-neutral-700 mt-2 leading-relaxed">
                    {addr.addressLine1}
                    {addr.addressLine2 ? `, ${addr.addressLine2}` : ""}
                    <br />
                    {addr.city}, {addr.state} - <span className="font-semibold">{addr.postalCode}</span>
                    <br />
                    {addr.country}
                  </p>
                </div>

                <div className="flex items-center justify-between pt-3 border-t border-neutral-100 text-xs gap-2">
                  <div className="flex items-center gap-2">
                    {!addr.isDefault && (
                      <button
                        type="button"
                        onClick={() => handleSetDefault(addr.id)}
                        className="text-neutral-500 hover:text-neutral-900 font-semibold underline text-[11px] cursor-pointer"
                      >
                        Set Default
                      </button>
                    )}
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => handleOpenEditModal(addr)}
                      className="p-1.5 rounded-lg text-neutral-500 hover:text-neutral-900 hover:bg-neutral-100 transition-colors cursor-pointer"
                      title="Edit address"
                    >
                      <EditIcon size={15} />
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDelete(addr.id)}
                      className="p-1.5 rounded-lg text-red-500 hover:text-red-700 hover:bg-red-50 transition-colors cursor-pointer"
                      title="Delete address"
                    >
                      <TrashIcon size={15} />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Address Edit / Add Modal */}
      {isModalOpen && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-neutral-900/50 backdrop-blur-xs animate-in fade-in duration-200"
        >
          <div
            className="w-full max-w-lg rounded-2xl bg-white shadow-modal overflow-hidden border border-neutral-200 flex flex-col max-h-[90vh]"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-neutral-100">
              <h3 className="text-base font-bold text-neutral-900">
                {editingAddress ? "Edit Delivery Address" : "Add New Delivery Address"}
              </h3>
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="p-1.5 rounded-lg text-neutral-400 hover:text-neutral-900 transition-colors cursor-pointer"
              >
                <CloseIcon size={18} />
              </button>
            </div>

            {/* Modal Form */}
            <form onSubmit={handleSubmit} className="p-6 overflow-y-auto space-y-4">
              {formErrors.general && (
                <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-xs text-red-700 flex items-center gap-2">
                  <AlertCircleIcon size={14} className="shrink-0" />
                  <span>{formErrors.general}</span>
                </div>
              )}

              {/* Label */}
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-neutral-700 mb-1">
                  Address Label
                </label>
                <div className="flex gap-2">
                  {["Home", "Work", "Other"].map((lbl) => (
                    <button
                      key={lbl}
                      type="button"
                      onClick={() => setFormData((prev) => ({ ...prev, label: lbl }))}
                      className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all cursor-pointer ${
                        formData.label === lbl
                          ? "border-primary bg-primary/10 text-neutral-900"
                          : "border-neutral-200 text-neutral-600 hover:bg-neutral-50"
                      }`}
                    >
                      {lbl}
                    </button>
                  ))}
                </div>
              </div>

              {/* Full Name & Phone */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-neutral-700 mb-1">
                    Full Name *
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.fullName}
                    onChange={(e) => setFormData((p) => ({ ...p, fullName: e.target.value }))}
                    placeholder="Recipient's name"
                    className="w-full h-11 px-3.5 rounded-xl border border-neutral-300 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
                  />
                  {formErrors.fullName && (
                    <p className="text-[11px] text-red-600 mt-1">{formErrors.fullName}</p>
                  )}
                </div>

                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-neutral-700 mb-1">
                    Phone Number *
                  </label>
                  <input
                    type="tel"
                    required
                    value={formData.phone}
                    onChange={(e) => setFormData((p) => ({ ...p, phone: e.target.value }))}
                    placeholder="10-digit mobile"
                    className="w-full h-11 px-3.5 rounded-xl border border-neutral-300 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
                  />
                  {formErrors.phone && (
                    <p className="text-[11px] text-red-600 mt-1">{formErrors.phone}</p>
                  )}
                </div>
              </div>

              {/* Address Line 1 */}
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-neutral-700 mb-1">
                  Address Line 1 *
                </label>
                <input
                  type="text"
                  required
                  value={formData.addressLine1}
                  onChange={(e) => setFormData((p) => ({ ...p, addressLine1: e.target.value }))}
                  placeholder="House/Flat No., Building Name, Street"
                  className="w-full h-11 px-3.5 rounded-xl border border-neutral-300 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
                />
                {formErrors.addressLine1 && (
                  <p className="text-[11px] text-red-600 mt-1">{formErrors.addressLine1}</p>
                )}
              </div>

              {/* Address Line 2 */}
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-neutral-700 mb-1">
                  Address Line 2 <span className="text-neutral-400 font-normal">(Optional)</span>
                </label>
                <input
                  type="text"
                  value={formData.addressLine2}
                  onChange={(e) => setFormData((p) => ({ ...p, addressLine2: e.target.value }))}
                  placeholder="Apartment, Suite, Landmark"
                  className="w-full h-11 px-3.5 rounded-xl border border-neutral-300 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
                />
              </div>

              {/* City, State & PIN */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-neutral-700 mb-1">
                    City *
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.city}
                    onChange={(e) => setFormData((p) => ({ ...p, city: e.target.value }))}
                    placeholder="City"
                    className="w-full h-11 px-3.5 rounded-xl border border-neutral-300 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
                  />
                  {formErrors.city && (
                    <p className="text-[11px] text-red-600 mt-1">{formErrors.city}</p>
                  )}
                </div>

                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-neutral-700 mb-1">
                    State *
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.state}
                    onChange={(e) => setFormData((p) => ({ ...p, state: e.target.value }))}
                    placeholder="State"
                    className="w-full h-11 px-3.5 rounded-xl border border-neutral-300 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
                  />
                  {formErrors.state && (
                    <p className="text-[11px] text-red-600 mt-1">{formErrors.state}</p>
                  )}
                </div>

                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-neutral-700 mb-1">
                    PIN Code *
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.postalCode}
                    onChange={(e) => setFormData((p) => ({ ...p, postalCode: e.target.value }))}
                    placeholder="6 digits"
                    className="w-full h-11 px-3.5 rounded-xl border border-neutral-300 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
                  />
                  {formErrors.postalCode && (
                    <p className="text-[11px] text-red-600 mt-1">{formErrors.postalCode}</p>
                  )}
                </div>
              </div>

              {/* Set Default Checkbox */}
              <div className="pt-2">
                <label className="flex items-center gap-2 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={formData.isDefault}
                    onChange={(e) => setFormData((p) => ({ ...p, isDefault: e.target.checked }))}
                    className="w-4 h-4 rounded text-primary focus:ring-primary border-neutral-300"
                  />
                  <span className="text-xs font-semibold text-neutral-700">
                    Set as default delivery address
                  </span>
                </label>
              </div>

              {/* Modal Actions */}
              <div className="pt-4 flex items-center justify-end gap-3 border-t border-neutral-100">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2.5 rounded-xl text-xs font-bold text-neutral-600 hover:bg-neutral-100 transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-6 py-2.5 rounded-xl text-xs font-bold uppercase tracking-wider transition-all duration-200 shadow-sm cursor-pointer disabled:opacity-50"
                  style={{
                    background: "var(--color-primary)",
                    color: "var(--color-neutral-900)",
                  }}
                >
                  {isSubmitting ? "Saving..." : editingAddress ? "Save Changes" : "Add Address"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </section>
  );
}
