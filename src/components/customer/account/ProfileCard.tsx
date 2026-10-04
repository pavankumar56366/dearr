"use client";

import React, { useState } from "react";
import {
  UserIcon,
  MailIcon,
  PhoneIcon,
  EditIcon,
  CheckIcon,
  CloseIcon,
} from "@/components/customer/Icons";
import type { DemoProfile } from "@/data/demo-account";
import { useAuth } from "@/context/AuthContext";

interface ProfileCardProps {
  profile: DemoProfile;
}

export default function ProfileCard({ profile }: ProfileCardProps) {
  const { user, refresh } = useAuth();
  const [isEditing, setIsEditing] = useState(false);
  const [editedProfile, setEditedProfile] = useState(profile);
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [showSaveSuccess, setShowSaveSuccess] = useState(false);

  React.useEffect(() => {
    setEditedProfile(profile);
  }, [profile]);

  const handleSave = async () => {
    if (user) {
      setIsSaving(true);
      setSaveError(null);
      try {
        const res = await fetch("/api/customer/profile", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          credentials: "same-origin",
          body: JSON.stringify({
            fullName: editedProfile.fullName,
            phone: editedProfile.phone,
          }),
        });

        const data = await res.json();
        if (res.ok && data.ok) {
          setIsEditing(false);
          setShowSaveSuccess(true);
          await refresh();
          setTimeout(() => setShowSaveSuccess(false), 3000);
        } else {
          setSaveError(data.error || "Failed to update profile");
        }
      } catch {
        setSaveError("Unable to update profile. Please try again later.");
      } finally {
        setIsSaving(false);
      }
    } else {
      // Demo local fallback if operating without active backend session
      setIsEditing(false);
      setShowSaveSuccess(true);
      setTimeout(() => setShowSaveSuccess(false), 3000);
    }
  };

  const handleCancel = () => {
    setEditedProfile(profile);
    setSaveError(null);
    setIsEditing(false);
  };

  const memberSince = new Date(profile.createdAt).toLocaleDateString("en-IN", {
    year: "numeric",
    month: "long",
  });

  return (
    <section
      aria-labelledby="profile-heading"
      className="rounded-2xl border border-neutral-200 bg-surface shadow-card overflow-hidden"
    >
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-4 sm:px-6 border-b border-neutral-100">
        <h2
          id="profile-heading"
          className="text-base sm:text-lg font-bold text-neutral-900 tracking-tight"
        >
          Profile Information
        </h2>
        {!isEditing && (
          <button
            type="button"
            onClick={() => {
              setSaveError(null);
              setIsEditing(true);
            }}
            className="flex items-center gap-1.5 text-xs font-semibold text-primary hover:text-[#91BC7A] transition-colors rounded-lg px-3 py-1.5 hover:bg-primary/10"
          >
            <EditIcon size={14} />
            Edit
          </button>
        )}
      </div>

      {/* Profile Content */}
      <div className="px-5 py-5 sm:px-6 space-y-5">
        {/* Avatar + Name */}
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 rounded-full bg-gradient-to-br from-primary/20 to-primary/40 border-2 border-primary/30 flex items-center justify-center text-primary font-bold text-xl shrink-0">
            {editedProfile.fullName ? editedProfile.fullName.charAt(0).toUpperCase() : "D"}
          </div>
          <div className="min-w-0 flex-1">
            {isEditing ? (
              <input
                type="text"
                value={editedProfile.fullName}
                onChange={(e) =>
                  setEditedProfile({ ...editedProfile, fullName: e.target.value })
                }
                aria-label="Full name"
                className="w-full text-lg font-bold text-neutral-900 bg-neutral-50 border border-neutral-300 rounded-xl px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary"
                style={{ fontSize: "16px" }}
              />
            ) : (
              <h3 className="text-lg font-bold text-neutral-900 truncate">
                {editedProfile.fullName}
              </h3>
            )}
            <p className="text-xs text-neutral-500 mt-0.5">
              Member since {memberSince}
            </p>
          </div>
        </div>

        {/* Field rows */}
        <div className="grid gap-4 sm:grid-cols-2">
          {/* Email */}
          <div className="flex items-start gap-3">
            <div className="w-9 h-9 rounded-lg bg-neutral-100 flex items-center justify-center shrink-0 mt-0.5">
              <MailIcon size={16} className="text-neutral-500" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-[11px] font-semibold text-neutral-400 uppercase tracking-wider mb-0.5">
                Email
              </p>
              {isEditing ? (
                <input
                  type="email"
                  value={editedProfile.email}
                  disabled
                  readOnly
                  aria-label="Email address"
                  className="w-full text-sm text-neutral-500 bg-neutral-100 border border-neutral-200 rounded-xl px-3 py-2 cursor-not-allowed"
                  style={{ fontSize: "16px" }}
                />
              ) : (
                <p className="text-sm font-medium text-neutral-900 truncate">
                  {editedProfile.email}
                </p>
              )}
            </div>
          </div>

          {/* Phone */}
          <div className="flex items-start gap-3">
            <div className="w-9 h-9 rounded-lg bg-neutral-100 flex items-center justify-center shrink-0 mt-0.5">
              <PhoneIcon size={16} className="text-neutral-500" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-[11px] font-semibold text-neutral-400 uppercase tracking-wider mb-0.5">
                Phone
              </p>
              {isEditing ? (
                <input
                  type="tel"
                  value={editedProfile.phone}
                  onChange={(e) =>
                    setEditedProfile({ ...editedProfile, phone: e.target.value })
                  }
                  placeholder="10-digit mobile number"
                  aria-label="Phone number"
                  className="w-full text-sm text-neutral-900 bg-neutral-50 border border-neutral-300 rounded-xl px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary"
                  style={{ fontSize: "16px" }}
                />
              ) : (
                <p className="text-sm font-medium text-neutral-900">
                  {editedProfile.phone}
                </p>
              )}
            </div>
          </div>
        </div>

        {/* Edit Actions */}
        {isEditing && (
          <div className="space-y-3 pt-2">
            {saveError && (
              <p role="alert" className="text-xs font-medium text-red-600">
                {saveError}
              </p>
            )}
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={handleSave}
                disabled={isSaving}
                className="h-10 px-5 rounded-xl bg-primary hover:bg-[#91BC7A] text-neutral-900 text-sm font-semibold transition-all active:scale-95 flex items-center gap-2 disabled:opacity-60 cursor-pointer"
              >
                <CheckIcon size={14} className="stroke-[3]" />
                {isSaving ? "Saving..." : "Save Changes"}
              </button>
              <button
                type="button"
                onClick={handleCancel}
                disabled={isSaving}
                className="h-10 px-5 rounded-xl border border-neutral-300 text-neutral-700 hover:bg-neutral-50 text-sm font-medium transition-all active:scale-95 flex items-center gap-2 cursor-pointer"
              >
                <CloseIcon size={14} />
                Cancel
              </button>
            </div>
          </div>
        )}

        {/* Save feedback */}
        {showSaveSuccess && (
          <div
            role="status"
            aria-live="polite"
            className="flex items-center gap-2 text-sm font-medium text-emerald-800 bg-emerald-50 border border-emerald-200 rounded-xl px-4 py-2.5"
          >
            <CheckIcon size={14} className="text-emerald-600 stroke-[3]" />
            Profile updated successfully
          </div>
        )}
      </div>
    </section>
  );
}
